import React from "react";
import { Elevation, CircularProgress, IconButton, Icon, Tooltip, Dialog, Button, ListItem } from 'rmcw';
import { v1 as uuid } from 'uuid';

import { fileSize } from "../../common/Tools";
import { Server, Settings } from "../../common/Providers";
import { Rest } from "../../common/Type";
import AnimatedList from "../../components/AnimatedList";

import FileExplorer from './file-explorer/Common';
import { SharedAxis, SharedAxisTransform } from "material-design-transform";
import { AnimatedSize } from "animated-size";
import { compress } from "../workers/Compress";

// @TODO: real multi explorer support

class MultiFileExplorer extends React.Component<MultiFileExplorer.Props, MultiFileExplorer.State>{
  constructor(props: MultiFileExplorer.Props) {
    super(props);
    this._controller = new FileExplorer.Controller({ auth: props.auth });
    this._uploadItems = [];
    this.state = {
      config: { showAll: false, sort: FileExplorer.SortType.alphabetically, uploadCompress: false },
      uploadItems: this._uploadItems,
      uploadManagementOpen: false,
    };
  }
  _controller: FileExplorer.Controller;
  _uploadItems: FileExplorer.UploadController[];
  protected _mounted = true;

  async _reconnect() {
    this._controller.dispose();
    this._controller = new FileExplorer.Controller({ auth: this._controller.auth });
    this.setState({});
  }

  protected _readFileAsArrayBuffer(file: File) {
    return new Promise<string | ArrayBuffer | null | undefined>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => resolve(event.target?.result);
      reader.onerror = reject;
      reader.onabort = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  protected _upload(file: File, dest: Rest.PathLike) {
    const { auth } = this.props;
    const abort = new AbortController();
    const target = [...dest, file.name];

    let fileGuard = false;
    const createPlaceholderFile = async () => {
      let res = await auth.rest('fs.writeFile',
        [target, "# Web-ssh-tool try to create file here. Don't edit/move/delete this file"]);
      if (Rest.isError(res)) {
      } else {
        fileGuard = true;
      }
      return res;
    }
    const releaseFileGuard = async () => {
      if (fileGuard) {
        fileGuard = false;
        await auth.rest('fs.unlink', [target]);
      }
    };

    const cancel = async () => {
      abort.abort();
      releaseFileGuard();
    };

    const controller = !this.state.config.uploadCompress ?
      new FileExplorer.UploadController({
        id: uuid(), file, dest, basename: file.name,
        upload: async (onUploadProgress, onDownloadProgress, isClosed) => {
          const result = await createPlaceholderFile();
          if (Rest.isError(result)) throw result.error;
          if (isClosed()) return await releaseFileGuard();
          try {
            await auth.upload(file, dest, file.name, {
              signal: abort.signal,
              onUploadProgress,
              onDownloadProgress,
            });
            fileGuard = false;
          } catch (error) {
            await releaseFileGuard();
            throw error;
          }

        },
        cancel,
      }) :
      new FileExplorer.UploadController({
        id: uuid(), file, dest, basename: file.name,
        upload: async (onUploadProgress, onDownloadProgress, isClosed) => {
          const [compressed, result] = await Promise.all([
            (async () => {
              // build compress data
              try {
                const buffer = await this._readFileAsArrayBuffer(file);
                if (buffer !== null && buffer instanceof ArrayBuffer) {
                  return await compress(buffer);
                } else {
                  throw new Error(`Read file [${file.name}] failed`);
                }
              } catch (error) {
                return { error };
              }

            })(),
            createPlaceholderFile(),
          ]);
          if (Rest.isError(result)) throw result.error;
          if (isClosed()) return await releaseFileGuard();
          if ('error' in compressed) {
            await releaseFileGuard();
            throw compressed.error;
          }

          const compressedFile = new File([compressed], file.name);
          let multer: Express.Multer.File;
          try {
            multer = await auth.upload(compressedFile, dest, null, {
              signal: abort.signal,
              onUploadProgress,
              onDownloadProgress,
            });
          } catch (error) {
            await releaseFileGuard();
            throw error;
          }

          if (isClosed()) {
            await Promise.all([
              releaseFileGuard(),
              auth.rest('fs.unlink', [[multer.path]]),
            ]);
          } else {
            const unzipResult = await auth.rest('unzip', [multer.path, target]);
            await auth.rest('fs.unlink', [[multer.path]]);
            if (Rest.isError(unzipResult)) {
              await releaseFileGuard();
              throw unzipResult.error;
            } else {
              fileGuard = false;
            }
          }
        },
        cancel,
      });
    const listener = () => {
      const { detail: { isClosed } } = controller;
      if (isClosed) {
        controller.removeEventListener('change', listener);
        if (this._mounted) {
          this._uploadItems = this._uploadItems.filter(value => {
            return !value.detail.isClosed;
          });
          this.setState({ uploadItems: this._uploadItems });
        }
      }
    }
    controller.addEventListener('change', listener);
    this._uploadItems.push(controller);
    this.setState({
      uploadItems: [...this._uploadItems],
      uploadManagementOpen: true,
    });
  }

  override componentWillUnmount(): void {
    this._mounted = false;
    this._controller.dispose();
    this._uploadItems.forEach(v => v.close());
  }

  override render() {
    const { config, uploadItems, uploadManagementOpen } = this.state;
    const closeUploadManagement = () => this.setState({ uploadManagementOpen: false });
    return (
      <>
        <Elevation className='full-size column' depth={2}
          style={{ paddingBottom: 16, }}>
          <FileExplorer
            controller={this._controller}
            uploadItems={uploadItems}
            config={config}
            setConfig={config => this.setState({ config })}
            upload={(file, dest) => this._upload(file, dest)}
            openUploadManagement={() => this.setState({ uploadManagementOpen: true })}
            reconnect={() => this._reconnect()} />
        </Elevation>
        <Dialog open={uploadManagementOpen}
          fullscreen
          onScrimClick={closeUploadManagement}
          onEscapeKey={closeUploadManagement}
          title="Upload"
          actions={<>
            <Button
              leading={<Icon>upload</Icon>}
              onClick={(e) => {
                e.preventDefault();
                const input = document.createElement('input');
                input.type = "file";
                input.multiple = true;
                input.onchange = (e) => {
                  const input = e.target as HTMLInputElement;
                  const { files } = input;
                  const { state } = this._controller.state;
                  if (files !== null && state !== undefined && typeof state.path === 'string') {
                    for (let i = 0; i < files.length; i++) {
                      const file = files.item(i);
                      if (file !== null) {
                        this._upload(file, [state.path]);
                      }
                    }
                  }
                };
                input.click();
              }}>Upload local files</Button>
            <div className='expanded' />
            <Button
              disabled={uploadItems.length === 0}
              onClick={() => {
                const uploadItems = this._uploadItems;
                this._uploadItems = [];
                this.setState({ uploadItems: this._uploadItems });
                for (const item of Array.from(uploadItems))
                  item.close();
              }}>clear all</Button>
            <Button onClick={closeUploadManagement}>close</Button>
          </>}>
          <AnimatedSize heightFactor={uploadItems.length === 0 ?
            {} :
            { size: 0 }}>No upload task</AnimatedSize>
          <AnimatedList>
            {uploadItems.map(value => {
              return {
                listId: value.detail.id,
                children: <AnimatedList.Wrap><UploadItem key={value as any} controller={value} /></AnimatedList.Wrap>,
              }
            })}
          </AnimatedList>
        </Dialog>
      </>
    );
  }
}

namespace MultiFileExplorer {
  export type Props = {
    readonly settings: Settings.Type,
    readonly server: Server.Type,
    readonly auth: Server.Authentication.Type,
  };

  export type State = {
    config: FileExplorer.Config,
    uploadItems: FileExplorer.UploadController[],
    uploadManagementOpen: boolean,
  };
}



function UploadItem(props: { controller: FileExplorer.UploadController }) {
  const [state, setState] = React.useState<FileExplorer.UploadController.State>(props.controller.detail.state);
  const [upload, setUpload] = React.useState(props.controller.upload);
  React.useEffect(() => {
    const { controller } = props;
    const onChange = () => setState(controller.detail.state);
    const onUpload = () => setUpload(controller.upload);
    controller.addEventListener('change', onChange);
    controller.addEventListener('upload', onUpload);
    return () => {
      controller.removeEventListener('change', onChange);
      controller.removeEventListener('upload', onUpload);
    };
  });
  const { controller: { detail: { file, dest, error } } } = props;
  return (
    <ListItem
      graphic={
        <SharedAxis
          keyId={state}
          transform={SharedAxisTransform.fromRightToLeft}
          forceRebuildAfterSwitched={false}
          style={{ width: 24 }}>
          {(() => {
            switch (state) {
              case FileExplorer.UploadController.State.running: {
                if (upload && upload.lengthComputable) {
                  if (upload.lengthComputable) {
                    const progress = upload.loaded / upload.total;
                    return (
                      <Tooltip label={`${(progress * 100).toFixed(1)} %; ${fileSize(upload.loaded)}; ${fileSize(upload.total)}`}>
                        <CircularProgress progress={progress} sizing='Small' />
                      </Tooltip>
                    );
                  } else {
                    return (
                      <Tooltip label={fileSize(upload.loaded)}>
                        <CircularProgress sizing='Small' />
                      </Tooltip>
                    );
                  }
                } else {
                  return <Tooltip label='Initialization'>
                    <CircularProgress sizing='Small' />
                  </Tooltip>;
                }

              }
              case FileExplorer.UploadController.State.error: {
                return <Icon>error</Icon>;
              }
              case FileExplorer.UploadController.State.cancel:
                return <Icon >cancel</Icon>;
              default:
                return <Icon>checked</Icon>;

            }
          })()}
        </SharedAxis>
      }
      primaryText={file.name}
      secondaryText={(() => {
        switch (state) {
          case FileExplorer.UploadController.State.error: {
            return <>{`${error}`}</>;
          }
        }
        return <>{dest}</>;
      })()}
      meta={
        <SharedAxis
          keyId={state}
          transform={SharedAxisTransform.fromTopToBottom}
          forceRebuildAfterSwitched={false}>
          {(() => {
            switch (state) {
              case FileExplorer.UploadController.State.running:
                return <IconButton onClick={() => props.controller.cancel()}>
                  <Icon>close</Icon>
                </IconButton>;
              default:
                return <IconButton onClick={() => props.controller.close()} >
                  <Icon>close</Icon>
                </IconButton>;
            }
          })()}
        </SharedAxis>
      }
    />
  );
}

export default MultiFileExplorer;
