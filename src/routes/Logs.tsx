import { useLocation } from 'react-router-dom';
const Logs = () => {
  const location = useLocation();
  return (
    <div>
      <h2>{location.pathname}</h2>
    </div>
  );
};

export default Logs;
