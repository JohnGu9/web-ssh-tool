import { Button } from "rmwc";

function ErrorPreview({ state: { error }, cd }: { state: { error: any }, cd: (path?: string) => unknown }) {
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Error Occur ({error.name ?? error.code})</div>
      <Button raised label='Return to home' onClick={() => cd()} />
    </div>
  );
}

export default ErrorPreview;

export function UnknownErrorPreview({ goHome }: { goHome: () => unknown }) {
  return (
    <div className='full-size column' style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ margin: '16px 0' }}>Unknown State (Server Error)</div>
      <Button raised label='Return to home' onClick={goHome} />
    </div>
  );
}