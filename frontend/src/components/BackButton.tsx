import { useNavigate } from 'react-router-dom';

const BackButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      aria-label="뒤로 가기"
      className="text-2xl"
    >
      &lt;
    </button>
  );
};

export default BackButton;
