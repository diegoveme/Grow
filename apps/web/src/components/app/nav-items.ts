import {
  ActivityIcon,
  OverviewIcon,
  PledgeIcon,
  ReceiveIcon,
  SendIcon,
  SettingsIcon,
  YieldIcon,
} from "./icons";

import type { Messages } from "@/lib/i18n/en";

export interface NavItem {
  href: string;
  /** Key in the `nav` messages; the label follows the app language. */
  label: keyof Messages["nav"];
  Icon: typeof OverviewIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "overview", Icon: OverviewIcon },
  { href: "/app/send", label: "send", Icon: SendIcon },
  { href: "/app/receive", label: "receive", Icon: ReceiveIcon },
  { href: "/app/activity", label: "activity", Icon: ActivityIcon },
  { href: "/app/pledges", label: "earmarked", Icon: PledgeIcon },
  { href: "/app/yield", label: "vault", Icon: YieldIcon },
  { href: "/app/settings", label: "settings", Icon: SettingsIcon },
];
