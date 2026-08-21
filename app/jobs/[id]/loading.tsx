export default function JobLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="h-4 w-24 bg-gray-800 rounded mb-6" />
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-32 bg-gray-800 rounded" />
        <div className="h-6 w-20 bg-gray-800 rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card py-3 px-4">
            <div className="h-3 w-16 bg-gray-800 rounded mb-2" />
            <div className="h-5 w-20 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      <div className="h-2 bg-gray-800 rounded-full mb-8" />
      <div className="h-6 w-28 bg-gray-800 rounded mb-4" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-48 bg-gray-800 rounded" />
              <div className="h-3 w-24 bg-gray-800 rounded" />
            </div>
            <div className="h-9 w-28 bg-gray-800 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
