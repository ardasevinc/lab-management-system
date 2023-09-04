import SidePanel from '@/components/SidePanel';
import TopPanel from '@/components/TopPanel';
import { Outlet } from 'react-router-dom';

const Root = () => {
  return (
    <div className='min-h-screen flex px-8 py-6'>
      <SidePanel />
      <div className='flex flex-col w-full'>
        <TopPanel />
        <main className='flex justify-center items-center h-full'>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Root;
