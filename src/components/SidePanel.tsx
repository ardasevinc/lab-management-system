import {
  HomeIcon,
  ComputerIcon,
  NetworkIcon,
  FileClockIcon,
  CalendarClockIcon,
  UserCogIcon,
  SettingsIcon,
  LucideIcon,
} from 'lucide-react';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from '@/components/primitives/NavMenu';
import NavigationLink from './primitives/NavigationLink';

interface NavItem {
  name: string;
  href: string;
  Icon: LucideIcon;
}

const navItems: NavItem[] = [
  {
    name: 'Home',
    href: '/',
    Icon: HomeIcon,
  },
  {
    name: 'Devices',
    href: '/devices',
    Icon: ComputerIcon,
  },
  {
    name: 'Network',
    href: '/network',
    Icon: NetworkIcon,
  },
  {
    name: 'Logs',
    href: '/logs',
    Icon: FileClockIcon,
  },
  {
    name: 'Schedule',
    href: '/schedule',
    Icon: CalendarClockIcon,
  },
  {
    name: 'Users',
    href: '/users',
    Icon: UserCogIcon,
  },
  {
    name: 'Setttings',
    href: '/settings',
    Icon: SettingsIcon,
  },
];

const SideNav = () => {
  return (
    <div>
      <h1 className='font-title text-2xl text-center border-b-2 p-2 mb-16'>
        Lab Management System
      </h1>
      <NavigationMenu
        orientation='vertical'
        className='flex-col max-w-none w-full items-stretch'
      >
        <NavigationMenuList className='[&>:not(:last-child)]:mb-8 flex-col'>
          {navItems.map(({ name, href, Icon }) => (
            <NavigationMenuItem key={name} className='w-full'>
              <NavigationMenuLink asChild>
                <NavigationLink
                  to={href}
                  className='block py-3 px-2 rounded-lg'
                >
                  <Icon size={20} className='inline-block' />{' '}
                  <span className='align-middle ml-4'>{name}</span>
                </NavigationLink>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
};

export default SideNav;
