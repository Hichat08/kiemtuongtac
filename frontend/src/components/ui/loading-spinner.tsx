export const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin"
          style={{
            animationDuration: "1s",
          }}
        ></div>
      </div>
    </div>
  );
};
