import { useLocation } from 'react-router-dom';
const Devices = () => {
  const location = useLocation();
  return (
    <div>
      <h2>{location.pathname}</h2>
    </div>
  );
};

export default Devices;
