export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-48 bg-gray-800 rounded" />
        <div className="h-10 w-32 bg-gray-800 rounded-lg" />
      </div>
      <div className="h-6 w-36 bg-gray-800 rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-gray-800 rounded" />
              <div className="h-5 w-20 bg-gray-800 rounded-full" />
            </div>
            <div className="h-3 w-32 bg-gray-800 rounded" />
            <div className="flex justify-between">
              <div className="h-4 w-20 bg-gray-700 rounded" />
              <div className="h-3 w-16 bg-gray-800 rounded" />
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
