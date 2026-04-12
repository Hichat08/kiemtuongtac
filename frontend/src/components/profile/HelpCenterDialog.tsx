import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SUPPORT_EMAIL } from "@/lib/support";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  ArrowLeft,
  ArrowRight,
  CircleDollarSign,
  ClipboardList,
  Rocket,
  Search,
  Settings2,
  type LucideIcon,
  MessageCircleMore,
  Mail,
  Plus,
  Minus,
} from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface HelpCenterDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

type SupportCategory = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  keywords: string[];
  onSelect: () => void;
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

const faqItems: FaqItem[] = [
  {
    id: "deposit",
    question: "Làm thế nào để nạp tiền vào ví?",
    answer:
      "Bạn vào mục Ví, chọn Nạp tiền, sau đó làm theo hướng dẫn chuyển khoản và chờ admin duyệt yêu cầu. Khi yêu cầu được xác nhận, số dư sẽ tự cập nhật về ví của bạn.",
    keywords: ["nạp tiền", "ví", "chuyển khoản", "số dư"],
  },
  {
    id: "task-review",
    question: "Tại sao nhiệm vụ của tôi chưa được duyệt?",
    answer:
      "Nhiệm vụ có thể đang chờ admin kiểm tra hoặc bị thiếu bằng chứng hợp lệ. Hãy kiểm tra lại ảnh/chứng cứ đã gửi và theo dõi trạng thái ở mục Lịch sử làm nhiệm vụ.",
    keywords: ["nhiệm vụ", "duyệt", "từ chối", "bằng chứng"],
  },
  {
    id: "withdraw-minimum",
    question: "Rút tiền tối thiểu là bao nhiêu?",
    answer:
      "Mức rút tối thiểu phụ thuộc cấu hình hiện tại của hệ thống. Nếu chưa chắc, hãy vào trang Ví để kiểm tra thông báo mới nhất trước khi gửi yêu cầu rút tiền.",
    keywords: ["rút tiền", "tối thiểu", "ví", "withdraw"],
  },
  {
    id: "invite-friends",
    question: "Tôi có thể mời bạn bè để nhận thưởng như thế nào?",
    answer:
      "Bạn mở mục Mời bạn bè trong hồ sơ để sao chép ID mời hoặc link đăng ký. Người được mời có thể đăng ký thường hoặc bằng Google, hệ thống vẫn ghi đúng người mời và hiển thị danh sách đã mời ngay trong ứng dụng.",
    keywords: ["mời bạn bè", "referral", "thưởng", "mã giới thiệu"],
  },
];

const HelpCenterDialog = ({ open, setOpen }: HelpCenterDialogProps) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaqId, setExpandedFaqId] = useState<string>(faqItems[0].id);

  useEffect(() => {
    if (!open || user?.role !== "admin") {
      return;
    }

    setOpen(false);
    navigate("/admin");
  }, [navigate, open, setOpen, user?.role]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearchQuery("");
    setExpandedFaqId(faqItems[0].id);
  }, [open]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const categories = useMemo<SupportCategory[]>(
    () => [
      {
        id: "start",
        title: "Bắt đầu",
        description: "Hướng dẫn cho người mới",
        icon: Rocket,
        iconClassName: "bg-[#f3edff] text-[#7b19d8]",
        keywords: ["bắt đầu", "người mới", "tài khoản", "đăng ký"],
        onSelect: () => {
          setSearchQuery("bắt đầu");
          setExpandedFaqId("deposit");
        },
      },
      {
        id: "wallet",
        title: "Rút tiền",
        description: "Ví & quy định thanh toán",
        icon: CircleDollarSign,
        iconClassName: "bg-[#00e0fe]/16 text-[#006574]",
        keywords: ["rút tiền", "ví", "thanh toán", "withdraw"],
        onSelect: () => {
          setOpen(false);
          navigate("/wallet");
        },
      },
      {
        id: "tasks",
        title: "Nhiệm vụ",
        description: "Lỗi & duyệt nhiệm vụ",
        icon: ClipboardList,
        iconClassName: "bg-[#c7cfff]/26 text-[#0846ed]",
        keywords: ["nhiệm vụ", "duyệt", "bị từ chối", "task"],
        onSelect: () => {
          setOpen(false);
          navigate("/tasks");
        },
      },
      {
        id: "account",
        title: "Tài khoản",
        description: "Bảo mật & cài đặt",
        icon: Settings2,
        iconClassName: "bg-[#e1e2e8] text-[#5a5b5f]",
        keywords: ["tài khoản", "bảo mật", "cài đặt", "hồ sơ"],
        onSelect: () => {
          setSearchQuery("tài khoản");
          setExpandedFaqId("invite-friends");
        },
      },
    ],
    [navigate, setOpen]
  );

  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) {
      return categories;
    }

    return categories.filter((category) =>
      [category.title, category.description, ...category.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [categories, normalizedSearch]);

  const filteredFaqs = useMemo(() => {
    if (!normalizedSearch) {
      return faqItems;
    }

    return faqItems.filter((item) =>
      [item.question, item.answer, ...item.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [normalizedSearch]);

  useEffect(() => {
    if (filteredFaqs.length === 0) {
      return;
    }

    const hasExpandedFaq = filteredFaqs.some((item) => item.id === expandedFaqId);

    if (!hasExpandedFaq) {
      setExpandedFaqId(filteredFaqs[0].id);
    }
  }, [expandedFaqId, filteredFaqs]);

  if (user?.role === "admin") {
    return null;
  }

  const handleEmailSupport = async () => {
    const subject = "Yeu cau ho tro tu nguoi dung";
    const body = `Xin chao doi ngu ho tro,%0D%0A%0D%0ATai khoan: ${user?.displayName ?? ""} (${user?.email ?? ""})%0D%0A%0D%0ANoi dung can ho tro:%0D%0A`;
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`;

    try {
      if (typeof window !== "undefined") {
        window.location.href = mailtoUrl;
        return;
      }
    } catch (error) {
      console.error("Không mở được ứng dụng email", error);
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(SUPPORT_EMAIL);
        toast.success("Đã sao chép email hỗ trợ.");
        return;
      }
    } catch (error) {
      console.error("Không sao chép được email hỗ trợ", error);
    }

    toast.info(`Email hỗ trợ: ${SUPPORT_EMAIL}`);
  };

  const handleOpenLiveChat = () => {
    setOpen(false);
    navigate("/chat/support");
  };

  const focusSearch = () => {
    searchInputRef.current?.focus();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-[#f6f6fa] p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Trung tâm hỗ trợ</DialogTitle>

        <div className="min-h-dvh bg-[#f6f6fa] font-auth-body text-[#2d2f32]">
          <header className="sticky top-0 z-20 bg-[#f6f6fa]/92 backdrop-blur-xl">
            <div className="mobile-page-shell flex items-center justify-between pb-3 pt-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full text-[#7b19d8] transition-colors hover:bg-[#f3edff] active:scale-95"
                  aria-label="Quay lại"
                >
                  <ArrowLeft className="size-5" />
                </button>
                <h1 className="font-auth-headline text-[1.1rem] font-bold tracking-tight text-[#7b19d8]">
                  Trung tâm hỗ trợ
                </h1>
              </div>

              <button
                type="button"
                onClick={focusSearch}
                className="flex size-9 items-center justify-center rounded-full text-[#6b6d71] transition-colors hover:bg-[#edf1ef] active:scale-95"
                aria-label="Tìm kiếm trợ giúp"
              >
                <Search className="size-4.5" />
              </button>
            </div>
          </header>

          <main className="mobile-page-shell pb-12 pt-6">
            <section className="mb-8">
              <h2 className="font-auth-headline text-[2.15rem] font-extrabold leading-[1.05] tracking-[-0.06em] text-[#2d2f32]">
                Chúng tôi có thể giúp gì cho bạn?
              </h2>

              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-[#8b8e94]" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Tìm kiếm câu hỏi, từ khóa hoặc hướng dẫn..."
                  className="h-14 w-full rounded-[1.35rem] border-0 bg-white pl-12 pr-4 text-sm text-[#2d2f32] shadow-[0_18px_42px_-34px_rgba(123,25,216,0.14)] outline-none ring-2 ring-transparent transition-all placeholder:text-[#a0a4aa] focus:ring-[#7b19d8]/14"
                />
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 font-auth-headline text-[1.05rem] font-bold text-[#2d2f32]">
                Danh mục phổ biến
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {filteredCategories.map((category) => {
                  const Icon = category.icon;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={category.onSelect}
                      className="rounded-[1.3rem] bg-[#f0f0f5] px-4 py-4 text-left transition-colors active:scale-[0.985] hover:bg-[#e7e8ed]"
                    >
                      <div
                        className={`flex size-11 items-center justify-center rounded-[1rem] ${category.iconClassName}`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <p className="mt-4 font-auth-headline text-[1rem] font-bold text-[#2d2f32]">
                        {category.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#6b6d71]">
                        {category.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 font-auth-headline text-[1.05rem] font-bold text-[#2d2f32]">
                Câu hỏi thường gặp (FAQ)
              </h3>

              <div className="space-y-3">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((item) => {
                    const isExpanded = item.id === expandedFaqId;

                    return (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_18px_42px_-34px_rgba(123,25,216,0.12)]"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedFaqId((current) =>
                              current === item.id ? "" : item.id
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#f3edff] text-[#7b19d8]">
                              ?
                            </div>
                            <span className="font-semibold leading-6 text-[#2d2f32]">
                              {item.question}
                            </span>
                          </div>
                          {isExpanded ? (
                            <Minus className="size-4 shrink-0 text-[#6b6d71]" />
                          ) : (
                            <Plus className="size-4 shrink-0 text-[#6b6d71]" />
                          )}
                        </button>

                        {isExpanded ? (
                          <div className="px-4 pb-4 pl-14 text-sm leading-6 text-[#5a5b5f]">
                            {item.answer}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1.25rem] bg-white px-4 py-6 text-center shadow-[0_18px_42px_-34px_rgba(123,25,216,0.12)]">
                    <p className="font-semibold text-[#2d2f32]">
                      Chưa tìm thấy nội dung phù hợp
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#6b6d71]">
                      Hãy thử từ khóa khác hoặc liên hệ đội ngũ hỗ trợ bên dưới.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="relative mb-8 overflow-hidden rounded-[1.8rem] bg-[#f3edff] px-5 py-6">
              <div className="relative z-10">
                <h3 className="font-auth-headline text-[1.5rem] font-extrabold tracking-[-0.05em] text-[#2d2f32]">
                  Bạn vẫn cần trợ giúp?
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#5a5b5f]">
                  Đội ngũ hỗ trợ của Kiếm Tương Tác luôn sẵn sàng giải đáp mọi thắc mắc
                  của bạn.
                </p>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={handleOpenLiveChat}
                    className="flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 py-3 font-bold text-white shadow-[0_18px_38px_-22px_rgba(123,25,216,0.32)] transition-transform active:scale-[0.99]"
                  >
                    <MessageCircleMore className="size-4.5" />
                    Chat trực tuyến
                  </button>

                  <button
                    type="button"
                    onClick={handleEmailSupport}
                    className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 font-bold text-[#2d2f32] shadow-[0_18px_38px_-26px_rgba(123,25,216,0.14)] transition-transform active:scale-[0.99]"
                  >
                    <Mail className="size-4.5 text-[#0846ed]" />
                    Gửi Email hỗ trợ
                  </button>
                </div>
              </div>

              <div className="pointer-events-none absolute -right-10 -top-8 h-32 w-32 rounded-full bg-[#ffb3e5]/28 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 rounded-full bg-[#7b19d8]/12 blur-2xl" />
            </section>

            <section className="overflow-hidden rounded-[1.7rem] bg-white p-4 shadow-[0_20px_46px_-34px_rgba(123,25,216,0.14)]">
              <div className="mb-4 h-44 overflow-hidden rounded-[1.4rem] bg-[linear-gradient(135deg,#7b19d8_0%,#a93bf0_42%,#ff66c7_100%)]">
                <div className="flex h-full items-end justify-between p-5">
                  <div className="max-w-[10rem]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffd8f5]">
                      Hướng dẫn đặc biệt
                    </span>
                    <p className="mt-3 font-auth-headline text-[1.35rem] font-extrabold leading-[1.15] tracking-[-0.04em] text-white">
                      Cách tối ưu hóa thu nhập từ các nhiệm vụ hằng ngày
                    </p>
                  </div>

                  <div className="relative flex h-24 w-24 items-center justify-center rounded-[1.4rem] bg-white/10 backdrop-blur-md">
                    <div className="absolute inset-0 rounded-[1.4rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.18),transparent)]" />
                    <ClipboardList className="relative z-10 size-10 text-white" />
                  </div>
                </div>
              </div>

              <p className="text-sm leading-6 text-[#5a5b5f]">
                Mẹo nhanh để hoàn thành nhiệm vụ đúng chuẩn, hạn chế lỗi duyệt và giữ
                nhịp kiếm tiền ổn định mỗi ngày.
              </p>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/tasks");
                }}
                className="mt-4 inline-flex items-center gap-2 font-bold text-[#7b19d8] transition-colors hover:text-[#5f22af]"
              >
                Xem hướng dẫn chi tiết
                <ArrowRight className="size-4" />
              </button>
            </section>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpCenterDialog;
