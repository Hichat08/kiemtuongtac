import AvatarUploader from "@/components/profile/AvatarUploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { User } from "@/types/user";
import axios from "axios";
import {
  ArrowLeft,
  CalendarDays,
  Facebook,
  Loader2,
  Lock,
  Mail,
  Music2,
  Phone,
  Save,
  UserRound,
  Users,
  Youtube,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  userInfo: User | null;
  onClose: () => void;
};

type ReadOnlyInfoItem = {
  id: string;
  label: string;
  value: string;
  icon: typeof UserRound;
  hint?: string;
};

type SocialConnectionItem = {
  id: string;
  label: string;
  icon: typeof Facebook;
  iconClassName: string;
  status: "linked" | "unlinked";
};

const formatMemberSince = (createdAt?: string) => {
  if (!createdAt) {
    return "Thành viên mới";
  }

  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Thành viên mới";
  }

  const monthYear = new Intl.DateTimeFormat("vi-VN", {
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);

  return `Thành viên từ tháng ${monthYear}`;
};

const PHONE_REGEX = /^[0-9+().\-\s]{8,20}$/;
const EMPTY_FORM_VALUES = {
  displayName: "",
  phone: "",
  bio: "",
};

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

const buildInitialFormValues = (userInfo: User) => ({
  displayName: userInfo.displayName ?? "",
  phone: userInfo.phone ?? "",
  bio: userInfo.bio ?? "",
});

const buildReadOnlyInfoItems = (userInfo: User): ReadOnlyInfoItem[] => [
  {
    id: "email",
    label: "Email",
    value: userInfo.email || "Chưa cập nhật",
    icon: Mail,
    hint: "Email hiện chưa hỗ trợ đổi trực tiếp trong ứng dụng.",
  },
  {
    id: "username",
    label: "Tên đăng nhập",
    value: userInfo.username || "Chưa cập nhật",
    icon: UserRound,
    hint: "Tên đăng nhập đang được khóa để đảm bảo định danh tài khoản.",
  },
  {
    id: "accountId",
    label: "Mã tài khoản",
    value: userInfo.accountId ? `#${userInfo.accountId}` : "Chưa cấp",
    icon: Lock,
    hint: "Mã tài khoản được tạo tự động và không thể chỉnh sửa.",
  },
];

const UNSUPPORTED_INFO_ITEMS: ReadOnlyInfoItem[] = [
  {
    id: "birthday",
    label: "Ngày sinh",
    value: "Chưa cập nhật",
    icon: CalendarDays,
    hint: "Hồ sơ mở rộng sẽ được bổ sung ở bản cập nhật tiếp theo.",
  },
  {
    id: "gender",
    label: "Giới tính",
    value: "Chưa cập nhật",
    icon: Users,
    hint: "Hồ sơ mở rộng sẽ được bổ sung ở bản cập nhật tiếp theo.",
  },
];

const SOCIAL_CONNECTIONS: SocialConnectionItem[] = [
  {
    id: "facebook",
    label: "Facebook",
    icon: Facebook,
    iconClassName: "bg-[#e9f3ff] text-[#1877F2]",
    status: "unlinked",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: Music2,
    iconClassName: "bg-black text-white",
    status: "unlinked",
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: Youtube,
    iconClassName: "bg-[#fff1f1] text-[#FF0000]",
    status: "unlinked",
  },
];

const PersonalInfoForm = ({ userInfo, onClose }: Props) => {
  const setUser = useAuthStore((state) => state.setUser);
  const [formValues, setFormValues] = useState(() =>
    userInfo ? buildInitialFormValues(userInfo) : EMPTY_FORM_VALUES
  );
  const [isSaving, setIsSaving] = useState(false);

  const memberSinceLabel = useMemo(
    () => formatMemberSince(userInfo?.createdAt),
    [userInfo?.createdAt]
  );

  useEffect(() => {
    if (!userInfo) {
      return;
    }

    setFormValues(buildInitialFormValues(userInfo));
  }, [userInfo?._id, userInfo?.displayName, userInfo?.phone, userInfo?.bio]);

  if (!userInfo) {
    return null;
  }

  const readOnlyInfoItems = buildReadOnlyInfoItems(userInfo);
  const trimmedDisplayName = formValues.displayName.trim();
  const trimmedPhone = formValues.phone.trim();
  const trimmedBio = formValues.bio.trim();
  const originalValues = buildInitialFormValues(userInfo);
  const hasChanges =
    trimmedDisplayName !== originalValues.displayName.trim() ||
    trimmedPhone !== originalValues.phone.trim() ||
    trimmedBio !== originalValues.bio.trim();
  const displayNameError =
    trimmedDisplayName.length === 0
      ? "Họ và tên không được để trống."
      : trimmedDisplayName.length > 100
        ? "Họ và tên tối đa 100 ký tự."
        : "";
  const phoneError =
    trimmedPhone && !PHONE_REGEX.test(trimmedPhone)
      ? "Số điện thoại chưa đúng định dạng."
      : "";
  const bioError = trimmedBio.length > 500 ? "Giới thiệu tối đa 500 ký tự." : "";
  const isSaveDisabled =
    isSaving || !hasChanges || Boolean(displayNameError || phoneError || bioError);

  const handleInputChange =
    (field: "displayName" | "phone" | "bio") =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormValues((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (displayNameError || phoneError || bioError) {
      toast.error(displayNameError || phoneError || bioError);
      return;
    }

    if (!hasChanges) {
      toast.info("Thông tin hiện chưa có thay đổi mới.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await userService.updateProfile({
        displayName: trimmedDisplayName,
        phone: trimmedPhone,
        bio: trimmedBio,
      });

      setUser(response.user);
      toast.success(response.message || "Đã cập nhật thông tin tài khoản.");
    } catch (error) {
      console.error("Lỗi khi cập nhật thông tin tài khoản", error);
      toast.error(getErrorMessage(error, "Không thể cập nhật thông tin tài khoản."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-[#f6f6fa] font-auth-body text-[#2d2f32]">
      <header className="sticky top-0 z-20 bg-[#f6f6fa]/92 backdrop-blur-xl">
        <div className="mobile-page-shell flex items-center pb-3 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="mr-3 flex size-9 items-center justify-center rounded-full text-[#7b19d8] transition-colors hover:bg-[#f3edff] active:scale-95"
            aria-label="Quay lại"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="font-auth-headline text-xl font-bold tracking-tight text-[#7b19d8]">
            Thông tin tài khoản
          </h1>
        </div>
      </header>

      <form onSubmit={handleSave}>
        <main className="mobile-page-shell pb-32 pt-4">
          <section className="mb-10 flex flex-col items-center">
            <div className="relative">
              <div className="rounded-full bg-gradient-primary p-1 shadow-[0_24px_56px_-30px_rgba(123,25,216,0.42)]">
                <Avatar className="size-28 rounded-full ring-4 ring-[#f6f6fa]">
                  <AvatarImage
                    src={userInfo.avatarUrl}
                    alt={trimmedDisplayName || userInfo.displayName}
                  />
                  <AvatarFallback className="bg-gradient-primary text-3xl font-bold text-white">
                    {(trimmedDisplayName || userInfo.displayName)?.charAt(0) ?? "K"}
                  </AvatarFallback>
                </Avatar>
              </div>

              <AvatarUploader
                buttonClassName="!absolute !-bottom-1 !-right-1 size-9 rounded-full border-2 border-[#f6f6fa] bg-[#ff8fd6] text-[#4d1d88] shadow-[0_18px_32px_-22px_rgba(123,25,216,0.45)] hover:bg-[#ffb3e5]"
                iconClassName="size-4"
              />
            </div>

            <div className="mt-5 text-center">
              <h2 className="font-auth-headline text-[1.85rem] font-extrabold tracking-[-0.05em] text-[#2d2f32]">
                {trimmedDisplayName || userInfo.displayName}
              </h2>
              <p className="mt-1 text-sm text-[#6a6f73]">{memberSinceLabel}</p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="pl-1 font-auth-headline text-lg font-bold text-[#2d2f32]">
                Thông tin cá nhân
              </h3>
              <span className="rounded-full bg-[#f3edff] px-3 py-1 text-xs font-semibold text-[#7b19d8]">
                Có thể chỉnh sửa
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-[1rem] bg-white p-4 shadow-[0_18px_44px_-36px_rgba(123,25,216,0.18)]">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[0.85rem] bg-[#f3edff] text-[#7b19d8]">
                    <UserRound className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="personal-display-name"
                      className="text-xs text-[#7a7f84]"
                    >
                      Họ và tên
                    </label>
                    <Input
                      id="personal-display-name"
                      value={formValues.displayName}
                      onChange={handleInputChange("displayName")}
                      placeholder="Nhập họ và tên hiển thị"
                      aria-invalid={displayNameError ? "true" : "false"}
                      className="mt-2 h-12 rounded-[0.95rem] border-[#eadfff] bg-[#fcfaff] px-4 text-[15px] text-[#2d2f32] shadow-none"
                    />
                    <p className="mt-2 text-xs text-[#7a7f84]">
                      Tên này sẽ hiển thị ở hồ sơ, chat và lịch sử giao dịch.
                    </p>
                    {displayNameError ? (
                      <p className="mt-2 text-xs font-medium text-[#d1437a]">
                        {displayNameError}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[1rem] bg-white p-4 shadow-[0_18px_44px_-36px_rgba(123,25,216,0.18)]">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[0.85rem] bg-[#f3edff] text-[#7b19d8]">
                    <Phone className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor="personal-phone"
                      className="text-xs text-[#7a7f84]"
                    >
                      Số điện thoại
                    </label>
                    <Input
                      id="personal-phone"
                      value={formValues.phone}
                      onChange={handleInputChange("phone")}
                      placeholder="Nhập số điện thoại liên hệ"
                      maxLength={20}
                      aria-invalid={phoneError ? "true" : "false"}
                      className="mt-2 h-12 rounded-[0.95rem] border-[#eadfff] bg-[#fcfaff] px-4 text-[15px] text-[#2d2f32] shadow-none"
                    />
                    <p className="mt-2 text-xs text-[#7a7f84]">
                      Hỗ trợ số Việt Nam hoặc định dạng quốc tế có dấu <code>+</code>.
                    </p>
                    {phoneError ? (
                      <p className="mt-2 text-xs font-medium text-[#d1437a]">{phoneError}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[1rem] bg-white p-4 shadow-[0_18px_44px_-36px_rgba(123,25,216,0.18)]">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-[0.85rem] bg-[#f3edff] text-[#7b19d8]">
                    <Users className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="personal-bio"
                        className="text-xs text-[#7a7f84]"
                      >
                        Giới thiệu ngắn
                      </label>
                      <span className="text-[11px] font-medium text-[#9b84c4]">
                        {trimmedBio.length}/500
                      </span>
                    </div>
                    <Textarea
                      id="personal-bio"
                      value={formValues.bio}
                      onChange={handleInputChange("bio")}
                      placeholder="Viết vài dòng để mọi người biết thêm về bạn"
                      maxLength={500}
                      rows={4}
                      aria-invalid={bioError ? "true" : "false"}
                      className="mt-2 rounded-[0.95rem] border-[#eadfff] bg-[#fcfaff] px-4 py-3 text-[15px] text-[#2d2f32] shadow-none"
                    />
                    <p className="mt-2 text-xs text-[#7a7f84]">
                      Mô tả ngắn giúp hồ sơ của bạn đầy đủ hơn.
                    </p>
                    {bioError ? (
                      <p className="mt-2 text-xs font-medium text-[#d1437a]">{bioError}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-10 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="pl-1 font-auth-headline text-lg font-bold text-[#2d2f32]">
                Thông tin tài khoản
              </h3>
              <span className="rounded-full bg-[#f6f0ff] px-3 py-1 text-xs font-semibold text-[#8f6bc3]">
                Chỉ xem
              </span>
            </div>

            <div className="space-y-3">
              {readOnlyInfoItems.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className="rounded-[1rem] bg-white px-4 py-4 shadow-[0_18px_44px_-36px_rgba(123,25,216,0.18)]"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-[0.85rem] bg-[#f3edff] text-[#7b19d8]">
                        <Icon className="size-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#7a7f84]">{item.label}</p>
                        <p className="mt-1 break-words text-[15px] font-semibold text-[#2d2f32]">
                          {item.value}
                        </p>
                        {item.hint ? (
                          <p className="mt-2 text-xs text-[#7a7f84]">{item.hint}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-10 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="pl-1 font-auth-headline text-lg font-bold text-[#2d2f32]">
                Hồ sơ mở rộng
              </h3>
              <span className="rounded-full bg-[#fff1f7] px-3 py-1 text-xs font-semibold text-[#d1437a]">
                Sắp mở
              </span>
            </div>

            <div className="space-y-3">
              {UNSUPPORTED_INFO_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className="rounded-[1rem] border border-dashed border-[#ecdff9] bg-[#fcfaff] px-4 py-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-[0.85rem] bg-white text-[#9b84c4]">
                        <Icon className="size-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#7a7f84]">{item.label}</p>
                        <p className="mt-1 text-[15px] font-semibold text-[#6f6781]">
                          {item.value}
                        </p>
                        {item.hint ? (
                          <p className="mt-2 text-xs text-[#8c819c]">{item.hint}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-10 space-y-4">
            <h3 className="pl-1 font-auth-headline text-lg font-bold text-[#2d2f32]">
              Liên kết mạng xã hội
            </h3>

            <div className="rounded-[1.35rem] bg-[#eef0f4] p-3">
              <div className="space-y-2">
                {SOCIAL_CONNECTIONS.map((item) => {
                  const Icon = item.icon;
                  const isLinked = item.status === "linked";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        toast.info("Liên kết mạng xã hội sẽ được bổ sung ở bước tiếp theo.")
                      }
                      className="flex w-full items-center justify-between rounded-[1rem] bg-white/70 px-4 py-4 text-left transition-colors hover:bg-white"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`flex size-9 items-center justify-center rounded-full ${item.iconClassName}`}
                        >
                          <Icon className="size-5" />
                        </div>
                        <span className="font-medium text-[#2d2f32]">{item.label}</span>
                      </div>

                      {isLinked ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3edff] px-3 py-1 text-xs font-semibold text-[#7b19d8]">
                          <span className="size-2 rounded-full bg-[#7b19d8]" />
                          Đã liên kết
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-[#b8c9ff] px-3 py-1 text-xs font-semibold text-[#4f67ff]">
                          Chưa liên kết
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        <div className="pointer-events-none sticky bottom-0 left-0 w-full bg-gradient-to-t from-[#f6f6fa] via-[#f6f6fa] to-transparent pb-6 pt-8">
          <div className="pointer-events-auto mobile-page-shell">
            <Button
              type="submit"
              disabled={isSaveDisabled}
              className="h-14 w-full rounded-full bg-gradient-primary text-base font-bold text-white shadow-[0_28px_54px_-28px_rgba(123,25,216,0.5)] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="size-4.5 animate-spin" /> : <Save className="size-4.5" />}
              {isSaving ? "Đang lưu thay đổi..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PersonalInfoForm;
