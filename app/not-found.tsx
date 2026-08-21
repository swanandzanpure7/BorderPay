import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl font-bold text-gray-700 mb-2">404</div>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-gray-400 mb-6 max-w-sm">
        The page you're looking for doesn't exist.
      </p>
      <Link href="/" className="btn-primary">
        ← Go Home
      </Link>
    </div>
  );
}
