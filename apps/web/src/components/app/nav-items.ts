import {
  ActivityIcon,
  OverviewIcon,
  ReceiveIcon,
  SendIcon,
  SettingsIcon,
  YieldIcon,
} from "./icons";

export interface NavItem {
  href: string;
  label: string;
  Icon: typeof OverviewIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Overview", Icon: OverviewIcon },
  { href: "/app/send", label: "Send", Icon: SendIcon },
  { href: "/app/receive", label: "Receive", Icon: ReceiveIcon },
  { href: "/app/activity", label: "Activity", Icon: ActivityIcon },
  { href: "/app/yield", label: "Yield", Icon: YieldIcon },
  { href: "/app/settings", label: "Settings", Icon: SettingsIcon },
];
