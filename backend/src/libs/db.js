import dns from "node:dns";
import mongoose from "mongoose";

const MONGO_CONNECT_OPTIONS = {
  family: 4,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
};

let mongoCustomDnsEnabled = false;

const formatMongoError = (error) => {
  if (!error) {
    return "Lỗi MongoDB không xác định";
  }

  const code = error.code ? `${error.code}: ` : "";
  return `${code}${error.message ?? String(error)}`;
};

const redactMongoCredentials = (connectionString) => {
  if (!connectionString) {
    return "";
  }

  return connectionString.replace(
    /(mongodb(?:\+srv)?:\/\/)([^:/?#]+):([^@/?#]+)@/i,
    "$1$2:<redacted>@"
  );
};

const isSrvResolutionError = (error) => {
  const combinedMessage = `${error?.message ?? ""} ${error?.cause?.message ?? ""}`;
  return /querysrv|enotfound|getaddrinfo|econnrefused/i.test(combinedMessage);
};

const isAtlasAccessListError = (error) => {
  const combinedMessage = `${error?.message ?? ""} ${error?.cause?.message ?? ""}`;
  return /whitelist|whitelisted|ip access list/i.test(combinedMessage);
};

const isSrvUri = (connectionString) =>
  typeof connectionString === "string" &&
  connectionString.trim().startsWith("mongodb+srv://");

const getMongoUriHostCount = (connectionString) => {
  if (typeof connectionString !== "string" || !connectionString.startsWith("mongodb://")) {
    return 0;
  }

  const withoutProtocol = connectionString.replace(/^mongodb:\/\//i, "");
  const authority = withoutProtocol.split("/")[0] ?? "";
  const hostsPart = authority.includes("@") ? authority.split("@").pop() ?? "" : authority;

  return hostsPart
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean).length;
};

const createMongoLookup = () => {
  return async (hostname, options, callback) => {
    const normalizedOptions = typeof options === "number" ? { family: options } : options ?? {};
    const wantsAll = Boolean(normalizedOptions?.all);
    const requestedFamily = normalizedOptions?.family;

    const resolveFamily = async (family) => {
      if (family === 6) {
        return (await dns.promises.resolve6(hostname)).map((address) => ({
          address,
          family: 6,
        }));
      }

      return (await dns.promises.resolve4(hostname)).map((address) => ({
        address,
        family: 4,
      }));
    };

    try {
      let addresses = [];

      if (requestedFamily === 4 || requestedFamily === 6) {
        addresses = await resolveFamily(requestedFamily);
      } else {
        try {
          addresses = await resolveFamily(4);
        } catch {
          addresses = await resolveFamily(6);
        }
      }

      if (!addresses.length) {
        callback(new Error(`Không tìm thấy bản ghi DNS cho ${hostname}`));
        return;
      }

      if (wantsAll) {
        callback(null, addresses);
        return;
      }

      callback(null, addresses[0].address, addresses[0].family);
    } catch (error) {
      dns.lookup(hostname, normalizedOptions, callback);
    }
  };
};

const configureMongoDnsServers = () => {
  const rawDnsServers = `${process.env.MONGODB_DNS_SERVERS ?? ""}`.trim();

  if (!rawDnsServers) {
    mongoCustomDnsEnabled = false;
    return;
  }

  const dnsServers = rawDnsServers
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (!dnsServers.length) {
    mongoCustomDnsEnabled = false;
    return;
  }

  dns.setServers(dnsServers);
  mongoCustomDnsEnabled = true;
  console.log(`Đang dùng DNS tùy chỉnh cho MongoDB: ${dnsServers.join(", ")}`);
};

const getMongoConnectOptions = (candidate) => {
  const connectOptions = {
    ...MONGO_CONNECT_OPTIONS,
  };

  if (mongoCustomDnsEnabled) {
    connectOptions.lookup = createMongoLookup();
  }

  if (
    candidate.source === "MONGODB_DIRECT_CONNECTIONSTRING" &&
    !isSrvUri(candidate.value) &&
    getMongoUriHostCount(candidate.value) === 1
  ) {
    connectOptions.directConnection = true;
  }

  return connectOptions;
};

const getMongoUriCandidates = () => {
  const uniqueCandidates = new Map();
  const pushCandidate = (source, value) => {
    if (typeof value !== "string") {
      return;
    }

    const normalizedValue = value.trim();
    if (!normalizedValue || uniqueCandidates.has(normalizedValue)) {
      return;
    }

    if (source === "MONGODB_DIRECT_CONNECTIONSTRING" && isSrvUri(normalizedValue)) {
      console.warn(
        "Bỏ qua MONGODB_DIRECT_CONNECTIONSTRING vì biến này phải dùng dạng mongodb://host1:27017,host2:27017,... thay vì mongodb+srv://"
      );
      return;
    }

    uniqueCandidates.set(normalizedValue, { source, value: normalizedValue });
  };

  pushCandidate("MONGODB_DIRECT_CONNECTIONSTRING", process.env.MONGODB_DIRECT_CONNECTIONSTRING);
  pushCandidate("MONGODB_URI", process.env.MONGODB_URI);
  pushCandidate("MONGODB_CONNECTIONSTRING", process.env.MONGODB_CONNECTIONSTRING);

  const candidates = [...uniqueCandidates.values()];

  if (candidates.length > 1) {
    console.warn(
      "Đang có nhiều cấu hình MongoDB khác nhau trong file .env. Hệ thống sẽ thử lần lượt từng cấu hình, nhưng bạn nên chỉ giữ lại một cấu hình đúng với môi trường hiện tại."
    );
  }

  return candidates;
};

const logSrvResolutionHint = (uriCandidates, lastError) => {
  const hasSrvCandidate = uriCandidates.some(({ value }) => value.startsWith("mongodb+srv://"));
  const hasDirectCandidate = uriCandidates.some(
    ({ source, value }) =>
      source === "MONGODB_DIRECT_CONNECTIONSTRING" || value.startsWith("mongodb://")
  );

  if (!hasSrvCandidate || hasDirectCandidate || !isSrvResolutionError(lastError)) {
    return;
  }

  console.error(
    "Không thể phân giải DNS/SRV cho MongoDB Atlas trong môi trường hiện tại."
  );
  console.error(
    "Bạn có thể thử thêm MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8 trong file .env."
  );
  console.error(
    "Hãy dùng MONGODB_DIRECT_CONNECTIONSTRING với các node Atlas thực tế,"
  );
  console.error(
    "hoặc chuyển sang MONGODB_URI dạng mongodb://... nếu bạn dùng Mongo local."
  );
};

const logAtlasAccessListHint = (lastError) => {
  if (!isAtlasAccessListError(lastError)) {
    return;
  }

  console.error(
    "MongoDB Atlas đang chặn kết nối từ IP hiện tại của máy này."
  );
  console.error(
    "Hãy thêm IP public của máy bạn vào Atlas Network Access List,"
  );
  console.error(
    "hoặc tạm thời mở 0.0.0.0/0 để xác nhận kết nối trước khi siết lại phạm vi truy cập."
  );
};

export const connectDB = async () => {
  configureMongoDnsServers();
  const uriCandidates = getMongoUriCandidates();

  if (!uriCandidates.length) {
    throw new Error(
      "Thiếu cấu hình MongoDB. Hãy đặt MONGODB_URI, MONGODB_CONNECTIONSTRING hoặc MONGODB_DIRECT_CONNECTIONSTRING trong file .env."
    );
  }

  let lastError = null;

  for (const candidate of uriCandidates) {
    try {
      const connectOptions = getMongoConnectOptions(candidate);

      if (connectOptions.directConnection) {
        console.log(
          "Đang ép MongoDB dùng directConnection cho MONGODB_DIRECT_CONNECTIONSTRING để tránh fallback sang các shard host khác."
        );
      }

      await mongoose.connect(candidate.value, connectOptions);
      console.log(`Liên kết CSDL thành công qua ${candidate.source}.`);
      return;
    } catch (error) {
      lastError = error;

      console.error(
        `Kết nối MongoDB thất bại với ${candidate.source} (${redactMongoCredentials(
          candidate.value
        )}): ${formatMongoError(error)}`
      );

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => {});
      }
    }
  }

  logSrvResolutionHint(uriCandidates, lastError);
  logAtlasAccessListHint(lastError);
  throw lastError ?? new Error("Không thể kết nối MongoDB.");
};
