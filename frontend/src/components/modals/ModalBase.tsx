import type { ReactNode } from "react";
import { Dialog } from "../ui/Dialog";

type ModalSize = "sm" | "md" | "lg";

type ModalBaseProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  disableClose?: boolean;
  size?: ModalSize;
  mobileAlign?: "center" | "top";
};

// Legacy modal API kept for existing dialogs; rendering and keyboard handling
// live in the shared Dialog component.
export function ModalBase({ subtitle, disableClose = false, ...props }: ModalBaseProps) {
  return <Dialog {...props} description={subtitle} dismissible={!disableClose} />;
}
