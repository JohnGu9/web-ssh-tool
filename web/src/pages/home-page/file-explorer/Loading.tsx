import { CircularProgress } from "rmwc";

function Loading() {
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </div>
  );
}

export default Loading;