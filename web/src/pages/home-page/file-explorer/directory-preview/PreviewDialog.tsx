import { Button, Dialog } from "rmcw";
import { Server } from "../../../../common/Providers";
import React from "react";

function PreviewDialog({ state, close }: {
    close: () => unknown,
    state: PreviewDialog.State
}) {
    const auth = React.useContext(Server.Authentication.Context);
    return <Dialog
        open={state.open}
        onScrimClick={close}
        onEscapeKey={close}
        title="Attention"
        actions={<>
            <Button onClick={(e) => {
                e.preventDefault();
                close();
                auth.preview(state.path);
            }}>preview</Button>
            <Button onClick={close}>close</Button>
        </>}>
        This file maybe an unsupported file for preview.
        <div style={{ opacity: 0.7 }}>
            Try to preview unsupported files that may just trigger download action (action depending on browser).
        </div>
    </Dialog>
}

namespace PreviewDialog {
    export type State = {
        open: boolean,
        path: string,
    };
}

export default PreviewDialog;
