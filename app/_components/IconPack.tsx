"use client";

import { Icon } from "@iconify/react";
import type { IconProps as IconifyReactIconProps } from "@iconify/react";
import type { ComponentType } from "react";

export type IconProps = Omit<IconifyReactIconProps, "height" | "icon" | "width"> & {
  absoluteStrokeWidth?: boolean;
  height?: number | string;
  size?: number | string;
  strokeWidth?: number | string;
  width?: number | string;
};

export type LucideIcon = ComponentType<IconProps>;

function createIcon(icon: string): LucideIcon {
  function IconifyIcon({
    absoluteStrokeWidth,
    height,
    size,
    strokeWidth,
    width,
    ...props
  }: IconProps) {
    void absoluteStrokeWidth;
    void strokeWidth;

    const resolvedWidth = width ?? size ?? "1em";
    const resolvedHeight = height ?? size ?? "1em";

    return <Icon aria-hidden="true" height={resolvedHeight} icon={icon} width={resolvedWidth} {...props} />;
  }

  IconifyIcon.displayName = `IconifyIcon(${icon})`;
  return IconifyIcon;
}

export const AlertTriangle = createIcon("solar:danger-triangle-linear");
export const ArrowDownRight = createIcon("solar:arrow-right-down-linear");
export const ArrowLeft = createIcon("solar:arrow-left-linear");
export const ArrowRight = createIcon("solar:arrow-right-linear");
export const ArrowUpRight = createIcon("solar:arrow-right-up-linear");
export const BadgeCheck = createIcon("solar:verified-check-linear");
export const Banknote = createIcon("solar:banknote-2-linear");
export const BarChart3 = createIcon("solar:chart-square-linear");
export const Bell = createIcon("solar:bell-linear");
export const BookOpen = createIcon("solar:notebook-linear");
export const BookOpenCheck = createIcon("solar:notebook-bookmark-linear");
export const Building2 = createIcon("solar:buildings-2-linear");
export const Calculator = createIcon("solar:calculator-minimalistic-linear");
export const CalendarDays = createIcon("solar:calendar-linear");
export const Check = createIcon("ic:round-check");
export const CheckCircle2 = createIcon("solar:check-circle-linear");
export const ChevronDown = createIcon("solar:alt-arrow-down-linear");
export const ChevronRight = createIcon("solar:alt-arrow-right-linear");
export const ChevronUp = createIcon("solar:alt-arrow-up-linear");
export const Circle = createIcon("solar:record-circle-linear");
export const Clock = createIcon("solar:clock-circle-linear");
export const ContactRound = createIcon("solar:user-id-linear");
export const Copy = createIcon("solar:copy-linear");
export const CreditCard = createIcon("solar:card-linear");
export const Download = createIcon("solar:download-linear");
export const EllipsisVertical = createIcon("solar:menu-dots-bold");
export const Eye = createIcon("solar:eye-linear");
export const ExternalLink = createIcon("solar:square-arrow-right-up-linear");
export const FileCheck2 = createIcon("solar:checklist-minimalistic-linear");
export const FileJson = createIcon("solar:code-file-linear");
export const FileSearch = createIcon("solar:minimalistic-magnifer-linear");
export const FileSpreadsheet = createIcon("solar:document-add-linear");
export const FileText = createIcon("solar:document-text-linear");
export const Filter = createIcon("solar:filter-linear");
export const Gauge = createIcon("solar:playback-speed-linear");
export const HelpCircle = createIcon("solar:question-circle-linear");
export const Inbox = createIcon("solar:inbox-linear");
export const Key = createIcon("solar:key-linear");
export const KeyRound = createIcon("solar:key-minimalistic-linear");
export const Landmark = createIcon("solar:banknote-2-linear");
export const LayoutDashboard = createIcon("solar:widget-5-linear");
export const LifeBuoy = createIcon("solar:question-circle-linear");
export const Link2 = createIcon("solar:link-linear");
export const Loader2 = createIcon("solar:refresh-linear");
export const Lock = createIcon("solar:lock-keyhole-linear");
export const LogOut = createIcon("solar:logout-2-linear");
export const Mail = createIcon("solar:letter-linear");
export const MailCheck = createIcon("solar:letter-opened-linear");
export const MailPlus = createIcon("solar:letter-unread-linear");
export const MapPin = createIcon("solar:map-point-linear");
export const Menu = createIcon("solar:hamburger-menu-broken");
export const MessageCircle = createIcon("solar:chat-round-dots-linear");
export const MessageSquareText = createIcon("solar:chat-square-like-linear");
export const Monitor = createIcon("solar:monitor-linear");
export const Moon = createIcon("solar:moon-linear");
export const MoreHorizontal = createIcon("qlementine-icons:menu-dots-16");
export const Paperclip = createIcon("solar:paperclip-linear");
export const Phone = createIcon("solar:phone-linear");
export const Plus = createIcon("solar:add-circle-linear");
export const Receipt = createIcon("solar:bill-list-linear");
export const ReceiptText = createIcon("solar:bill-list-linear");
export const RefreshCw = createIcon("solar:restart-linear");
export const Save = createIcon("solar:diskette-linear");
export const ScanLine = createIcon("solar:scanner-linear");
export const Search = createIcon("iconamoon:search-light");
export const Send = createIcon("solar:plain-linear");
export const Settings = createIcon("solar:settings-linear");
export const Share2 = createIcon("solar:share-linear");
export const Shield = createIcon("solar:shield-linear");
export const ShieldCheck = createIcon("solar:shield-check-linear");
export const ShoppingCart = createIcon("solar:cart-large-2-linear");
export const SlidersHorizontal = createIcon("solar:tuning-2-linear");
export const Sparkles = createIcon("solar:stars-linear");
export const Sun = createIcon("solar:sun-linear");
export const Tag = createIcon("solar:tag-linear");
export const Trash2 = createIcon("solar:trash-bin-trash-linear");
export const Upload = createIcon("solar:upload-linear");
export const UploadCloud = createIcon("solar:cloud-upload-linear");
export const UserCircle = createIcon("solar:user-circle-linear");
export const UserCog = createIcon("solar:settings-linear");
export const UserMinus = createIcon("solar:user-minus-linear");
export const UserRound = createIcon("solar:user-circle-linear");
export const Users = createIcon("solar:users-group-rounded-linear");
export const WalletCards = createIcon("solar:wallet-linear");
export const X = createIcon("solar:close-circle-linear");
export const XCircle = createIcon("solar:close-circle-linear");
export const CheckIcon = Check;
export const ChevronDownIcon = ChevronDown;
export const ChevronRightIcon = ChevronRight;
export const ChevronUpIcon = ChevronUp;
export const XIcon = X;
