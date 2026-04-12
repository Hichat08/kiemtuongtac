import { type Dispatch, type SetStateAction, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { useAuthStore } from "@/stores/useAuthStore";
import PersonalInfoForm from "./PersonalInfoForm";
import { useNavigate } from "react-router";

interface ProfileDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const ProfileDialog = ({ open, setOpen }: ProfileDialogProps) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open || user?.role !== "admin") {
      return;
    }

    setOpen(false);
    navigate("/admin");
  }, [navigate, open, setOpen, user?.role]);

  if (user?.role === "admin") {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-[#f6f6fa] p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Thông tin tài khoản</DialogTitle>
        <PersonalInfoForm
          userInfo={user}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
