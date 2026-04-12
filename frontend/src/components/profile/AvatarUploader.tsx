import { useUserStore } from "@/stores/useUserStore";
import { useRef } from "react";
import { Button } from "../ui/button";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

type AvatarUploaderProps = {
  buttonClassName?: string;
  iconClassName?: string;
};

const AvatarUploader = ({ buttonClassName, iconClassName }: AvatarUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updateAvatarUrl } = useUserStore();

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();

    formData.append("file", file);

    await updateAvatarUrl(formData);
  };

  return (
    <>
      <Button
        size="icon"
        variant="secondary"
        onClick={handleClick}
        className={cn(
          "absolute -bottom-2 -right-2 size-9 rounded-full shadow-md transition duration-300 hover:scale-115 hover:bg-background",
          buttonClassName
        )}
      >
        <Camera className={cn("size-4", iconClassName)} />
      </Button>

      <input
        type="file"
        hidden
        ref={fileInputRef}
        onChange={handleUpload}
        accept="image/*"
      />
    </>
  );
};

export default AvatarUploader;
