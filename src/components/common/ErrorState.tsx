export const ErrorState = ({
  message,
  retry
}: {
  message: string;
  retry?: () => void;
}) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
    <p className="font-medium">{message}</p>
    {retry ? (
      <button
        type="button"
        onClick={retry}
        className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1 text-sm hover:bg-rose-100"
      >
        Try again
      </button>
    ) : null}
  </div>
);