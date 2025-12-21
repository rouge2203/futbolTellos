import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-6xl font-bold text-white mb-4">404</h1>
      <p className="text-white text-lg mb-4">Page not found</p>
      <Link to="/" className="text-blue-400 hover:text-blue-300 underline">
        Go back to home
      </Link>
    </div>
  );
}

export default NotFound;

