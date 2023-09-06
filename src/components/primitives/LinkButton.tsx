import cn from '@/utils/cn';
import { Link } from 'react-router-dom';

interface LinkButtonProps {
  children: React.ReactNode;
  className?: string;
  to: string;
}

const LinkButton = ({ children, className, to, ...props }: LinkButtonProps) => {
  return (
    <Link
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90',
        className,
      )}
      to={to}
      {...props}
    >
      {children}
    </Link>
  );
};

export default LinkButton;
