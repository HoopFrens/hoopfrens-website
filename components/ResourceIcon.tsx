import type { ResourceIcon as ResourceIconName } from "@/data/resources";
import {
  BadgeDollarSign,
  CalendarRange,
  CircleHelp,
  ClipboardCheck,
  Film,
  GitBranch,
  Mail,
  Network,
  ShieldQuestion,
  Users,
} from "lucide-react";

const icons = {
  calendar: CalendarRange,
  levels: Network,
  email: Mail,
  video: Film,
  parents: Users,
  scholarship: BadgeDollarSign,
  eligibility: ClipboardCheck,
  myths: ShieldQuestion,
  questions: CircleHelp,
  transfer: GitBranch,
};

export function ResourceIcon({ name, size = 28 }: { name: ResourceIconName; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size} />;
}
