import React from "react";
import { v4 } from "uuid";

export function useUuidV4() {
    return React.useMemo(() => v4(), []);
}
