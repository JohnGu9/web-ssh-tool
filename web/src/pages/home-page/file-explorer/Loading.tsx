import { CircularProgress } from "rmcw";

function Loading() {
  return (
    <div className='full-size column flex-center'>
      <CircularProgress />
    </div>
  );
}

export default Loading;
