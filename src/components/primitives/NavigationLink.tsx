import { NavLink } from 'react-router-dom';
import { forwardRef } from 'react';
import cn from '@/utils/cn';

const NavigationLink = forwardRef(
  ({ className, children, to, ...props }, _ref) => (
    <NavLink
      to={to}
      ref={_ref}
      className={({ isActive, isPending }) =>
        isPending
          ? cn('bg-destructive', className)
          : isActive
          ? cn('bg-primary', className)
          : cn('bg-foreground', className)
      }
      {...props}
    >
      {children}
    </NavLink>
  ),
);

export default NavigationLink;
