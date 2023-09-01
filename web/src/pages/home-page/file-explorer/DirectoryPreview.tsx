import React from "react";
import { Lstat, Watch } from "../../../common/Type";
import { SharedAxis, SharedAxisTransform } from 'material-design-transform';
import { FixedSizeList } from "../../../components/AdaptedWindow";
import EventListenerBuilder from "../../../components/EventListenerBuilder";

import FileExplorer, { NavigatorBar } from "./Common";
import InformationDialog from "./directory-preview/InformationDialog";
import FileListTile from "./directory-preview/FileListTile";
import DropZone from "./directory-preview/DropZone";
import ToolsBar, { SelectingToolsBar } from "./directory-preview/ToolsBar";
import FileMoveDialog from "./directory-preview/FileMoveDialog";
import RequestPreviewDialog from "./directory-preview/RequestPreviewDialog";

function DirectoryPreView({ state }: { state: Watch.Directory }) {
  const { path, entries } = state;
  const { config, uploadItems } = React.useContext(FileExplorer.Context);
  const [onSelecting, setOnSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set<Lstat>());
  const [information, setInformation] = React.useState<InformationDialog.State>({ open: false, stat: {} as Lstat, dirPath: path ?? "" });
  const [fileMove, setFileMove] = React.useState<FileMoveDialog.State>({ open: false, filename: "", path: "", target: "" });
  const [preview, setPreview] = React.useState<RequestPreviewDialog.State>({ open: false, path: "" });
  const fileList = FileExplorer.sortArray(Object.entries(entries).filter(config.showAll
    ? () => true
    : ([key]) => !key.startsWith('.')), config.sort);

  React.useEffect(() => {
    const l = Object.values(entries);
    const e = new Set(l.map(v => v.path));
    setSelected(current => {
      const c = Array.from(current);
      return new Set(
        c.filter(v => e.has(v.path) && typeof v.basename === 'string')
          .map(v => entries[v.basename!]));
    });
    setInformation(current => {
      if (e.has(current.stat.path)) {
        const newState = l.find(v => v.path === current.stat.path);
        if (newState !== undefined) {
          return { ...current, stat: newState };
        }
      }
      return { ...current, open: false };
    });
    setFileMove(v => {
      if (e.has(v.path) && e.has(v.target)) {
        return v;
      }
      return { ...v, open: false };
    });
    setPreview(v => {
      if (e.has(v.path)) {
        return v;
      }
      return { ...v, open: false };
    });
  }, [entries]);

  const context = React.useMemo(() => {
    return {
      state,
      selected, setSelected,
      onSelecting, setOnSelecting,
      setInformation, setFileMove, setPreview,
    };
  }, [onSelecting, selected, state]);

  return (
    <DirectoryPreView.Context.Provider value={context}>
      <div className='full-size column' >
        <SharedAxis className='row' style={{ height: 56, padding: '0 8px 0 0' }}
          transform={SharedAxisTransform.fromTopToBottom} keyId={onSelecting ? 0 : 1}
          forceRebuildAfterSwitched={false}>
          {onSelecting
            ? <SelectingToolsBar />
            : <ToolsBar />}
        </SharedAxis>
        <DropZone style={{ flex: 1, width: '100%', minHeight: 0 }} dirPath={path}>
          {fileList.length === 0 ?
            <div className='column' style={{ width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              Nothing here...
            </div> :
            <List fileList={fileList} uploadItems={uploadItems} />}
        </DropZone>
        <div style={{ height: 16 }} />
        {path === undefined || path === null ?
          <></> : // @TODO: new navigator bar
          <NavigatorBar path={path} />}
        <InformationDialog
          key={information.stat.path}
          state={information}
          close={() => setInformation({ ...information, open: false })} />
        <FileMoveDialog {...fileMove}
          close={() => setFileMove(v => { return { ...v, open: false } })} />
        <RequestPreviewDialog state={preview}
          close={() => setPreview(v => { return { ...v, open: false } })} />
      </div>
    </DirectoryPreView.Context.Provider>
  );
}

namespace DirectoryPreView {
  export type ContextType = {
    state: Watch.Directory,

    selected: Set<Lstat>,
    setSelected: React.Dispatch<React.SetStateAction<Set<Lstat>>>,

    onSelecting: boolean,
    setOnSelecting: React.Dispatch<React.SetStateAction<boolean>>,

    setInformation: React.Dispatch<React.SetStateAction<InformationDialog.State>>,
    setFileMove: React.Dispatch<React.SetStateAction<FileMoveDialog.State>>,
    setPreview: React.Dispatch<React.SetStateAction<RequestPreviewDialog.State>>,
  };
  export const Context = React.createContext<ContextType>(undefined as unknown as ContextType);
}

export default DirectoryPreView;

class List extends React.Component<{
  fileList: [string, Lstat][],
  uploadItems: FileExplorer.UploadController[],
}> {

  protected readonly eventTarget = new EventTarget();
  override componentDidUpdate(oldProp: any) {
    if (this.props.uploadItems !== oldProp.uploadItems) {
      this.eventTarget.dispatchEvent(new Event('change'));
    } else if (Object.keys(this.props).some(value => (this.props as any)[value] !== oldProp[value])) {
      this.eventTarget.dispatchEvent(new Event('change'));
    }
  }

  builder = ({ index, style }: { index: number, style?: React.CSSProperties }) => {
    return <EventListenerBuilder eventName='change' eventTarget={this.eventTarget}
      builder={() => {
        const { fileList } = this.props;
        if (index >= fileList.length) return <React.Fragment key={index}></React.Fragment>;
        const [key, value] = fileList[index];
        return <FileListTile
          key={key}
          style={style}
          uploading={this.props.uploadItems.find(v => {
            return false; // @TODO: detect uploading status
            // return (v.detail.dest === path || v.detail.dest === realPath) && v.detail.basename === basename;
          }) !== undefined}
          name={key}
          stats={value} />;
      }} />;
  }

  override render() {
    const { fileList } = this.props;
    return (
      <FixedSizeList className='full-size' itemCount={fileList.length + 2} itemSize={48}>
        {this.builder}
      </FixedSizeList>
    );
  }
}

