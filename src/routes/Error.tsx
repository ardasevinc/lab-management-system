import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import LinkButton from '@/components/primitives/LinkButton';

const RouteError = (error) => {
  return (
    <>
      <h1 className='scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl text-center mb-10'>
        Oopsie Woopsie!
      </h1>
      <div className='flex flex-col justify-center items-center'>
        <img
          src='/images/error.png'
          alt='sad robot'
          className='rounded-lg w-full max-w-md'
        />
        <h2 className='mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0'>
          Route Error {error.status && `(${error.status})`}
        </h2>
        {error.statusText && (
          <blockquote className='mt-6 border-l-2 pl-6 italic'>
            {error.statusText}
          </blockquote>
        )}
        <p className='leading-7 [&:not(:first-child)]:mt-6'>
          We will whip the developers extra hard to make sure this doesn't
          happen again!
        </p>
      </div>
    </>
  );
};

const OtherError = (error) => {
  return (
    <>
      <h1 className='scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-10'>
        What was that?
      </h1>
      <div className='flex'>
        <img src='/images/error.png' alt='sad robot' className='w-1/2' />
        <div>
          <h2 className='scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0'>
            Route Error {error.status && `(${error.status})`}
          </h2>
          {error.statusText && (
            <blockquote className='mt-6 border-l-2 pl-6 italic'>
              {error.statusText}
            </blockquote>
          )}
          <p className='leading-7 [&:not(:first-child)]:mt-6'>
            We will whip the developers extra hard to make sure this doesn't
            happen again!
          </p>
        </div>
      </div>
    </>
  );
};

const Error = () => {
  const error = useRouteError();
  return (
    <main className='container flex flex-col justify-center items-center h-screen gap-y-16'>
      <div>
        {isRouteErrorResponse(error) ? (
          <RouteError error={error} />
        ) : (
          <OtherError error={error} />
        )}
        <LinkButton to='/' className='mt-6 block mx-auto w-fit p-2'>
          Go back to dashboard
        </LinkButton>
      </div>
    </main>
  );
};

export default Error;
