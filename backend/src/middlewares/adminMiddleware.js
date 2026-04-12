export const adminOnly = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Bạn cần đăng nhập để tiếp tục." });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Bạn không có quyền truy cập khu vực admin.",
      });
    }

    next();
  } catch (error) {
    console.error("Lỗi khi kiểm tra quyền admin", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
