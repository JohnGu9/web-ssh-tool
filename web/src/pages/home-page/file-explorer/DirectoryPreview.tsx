import React from "react";
import { Lstat, Watch } from "../../../common/Type";
import { SharedAxis, SharedAxisTransform } from 'material-design-transform';
import { FixedSizeList } from "../../../components/AdaptedWindow";
import EventListenerBuilder from "../../../components/EventListenerBuilder";

import FileExplorer, { NavigatorBar } from "./Common";
import InformationDialog from "./directory-preview/InformationDialog";
import FileListTile from "./directory-preview/FileListTile";
import DropZone from "./directory-preview/DropZone";
import ToolsBar, { DraggingToolbar, SelectingToolsBar } from "./directory-preview/ToolsBar";
import FileMoveDialog from "./directory-preview/FileMoveDialog";
import RequestPreviewDialog from "./directory-preview/RequestPreviewDialog";
import DeleteDialog from "./directory-preview/DeleteDialog";
import CopyToDialog from "./directory-preview/CopyToDialog";
import PreviewDialog from "./directory-preview/PreviewDialog";

function DirectoryPreView({ state }: { state: Watch.Directory }) {
  const { path, entries } = state;
  const { config, uploadItems } = React.useContext(FileExplorer.Context);
  const [dragging, setDragging] = React.useState<unknown | null>(null); // when any element is dragging
  const [onSelecting, setOnSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set<Lstat>());

  const [information, setInformation] = React.useState<InformationDialog.State>({ open: false, stat: {} as Lstat, dirPath: path ?? "" });
  const [fileMove, setFileMove] = React.useState<FileMoveDialog.State>({ open: false, filename: "", path: "", target: "" });
  const [preview, setPreview] = React.useState<PreviewDialog.State>({ open: false, lstat: null });
  const [requestPreview, setRequestPreview] = React.useState<RequestPreviewDialog.State>({ open: false, lstat: null });
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialog.State>({ objects: [], open: false });
  const [copyDialog, setCopyDialog] = React.useState<CopyToDialog.State>({ objects: [], open: false, });
  const { showAll, sort } = config;
  const fileList = React.useMemo(() => {
    return FileExplorer.sortArray(Object.entries(entries).filter(showAll || onSelecting
      ? () => true
      : ([key]) => !key.startsWith('.')), sort)
  }, [entries, onSelecting, showAll, sort]);

  React.useEffect(() => {
    setDragging(null);
    setSelected(new Set());
    setOnSelecting(false);
    const open = false;
    setInformation(v => { return { ...v, open } });
    setFileMove(v => { return { ...v, open } });
    setRequestPreview(v => { return { ...v, open } });
  }, [path]);

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
    setRequestPreview(v => {
      if (e.has(v.lstat?.path)) {
        return v;
      }
      return { ...v, open: false };
    });
  }, [entries]);

  const context = React.useMemo(() => {
    return {
      state,
      selected, setSelected,
      onSelecting, setOnSelecting, setPreview,
      setInformation, setFileMove, setRequestPreview,
      setDeleteDialog, setCopyDialog,
      informationDialog: information,
      deleteDialog,
    };
  }, [deleteDialog, information, onSelecting, selected, state]);

  return (
    <DirectoryPreView.Context.Provider value={context}>
      <div className='full-size column' >
        <SharedAxis className='row' style={{ height: 56, padding: '0 8px 0 0' }}
          transform={SharedAxisTransform.fromTopToBottom}
          keyId={onSelecting ? 0 : dragging === null ? 1 : 2}
          forceRebuildAfterSwitched={false}>
          {onSelecting
            ? <SelectingToolsBar />
            : dragging === null ?
              <ToolsBar /> :
              <DraggingToolbar />}
        </SharedAxis>
        <DropZone style={{ flex: 1, width: '100%', minHeight: 0 }}
          dirPath={path}
          dragging={dragging}
          setDragging={setDragging}>
          {fileList.length === 0 ?
            <div className='column flex-center' style={{ width: '100%' }}>
              Nothing here...
            </div> :
            <List fileList={fileList} uploadItems={uploadItems} />}
        </DropZone>
        <div style={{ height: 16 }} />
        {path === undefined || path === null ?
          <></> : // @TODO: new navigator bar
          <NavigatorBar path={path} />}
        <InformationDialog state={information}
          close={() => setInformation(v => { return { ...v, open: false } })} />
        <FileMoveDialog state={fileMove}
          close={() => setFileMove(v => { return { ...v, open: false } })} />
        <PreviewDialog state={preview}
          close={() => setPreview(v => { return { ...v, open: false } })} />
        <RequestPreviewDialog state={requestPreview}
          close={() => setRequestPreview(v => { return { ...v, open: false } })} />
        <DeleteDialog state={deleteDialog}
          close={() => setDeleteDialog(v => { return { ...v, open: false } })} />
        <CopyToDialog state={copyDialog}
          close={() => setCopyDialog(v => { return { ...v, open: false } })} />
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
    setPreview: React.Dispatch<React.SetStateAction<PreviewDialog.State>>,
    setRequestPreview: React.Dispatch<React.SetStateAction<RequestPreviewDialog.State>>,
    setDeleteDialog: React.Dispatch<React.SetStateAction<DeleteDialog.State>>,
    setCopyDialog: React.Dispatch<React.SetStateAction<CopyToDialog.State>>,

    informationDialog: InformationDialog.State,
    deleteDialog: DeleteDialog.State,
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

