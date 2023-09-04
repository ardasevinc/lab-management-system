import {
  HomeIcon,
  ComputerIcon,
  NetworkIcon,
  FileClockIcon,
  CalendarClockIcon,
  UserCogIcon,
  SettingsIcon,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  Icon: JSX.Element;
}

const navItems: NavItem[] = [
  {
    name: 'Home',
    href: '/',
    Icon: <HomeIcon />,
  },
  {
    name: 'Devices',
    href: '/devices',
    Icon: <ComputerIcon />,
  },
  {
    name: 'Network',
    href: '/network',
    Icon: <NetworkIcon />,
  },
  {
    name: 'Logs',
    href: '/logs',
    Icon: <FileClockIcon />,
  },
  {
    name: 'Schedule',
    href: '/schedule',
    Icon: <CalendarClockIcon />,
  },
  {
    name: 'Users',
    href: '/users',
    Icon: <UserCogIcon />,
  },
  {
    name: 'Setttings',
    href: '/settings',
    Icon: <SettingsIcon />,
  },
];

const SideNav = () => {
  return <div>hello world</div>;
};

export default SideNav;
