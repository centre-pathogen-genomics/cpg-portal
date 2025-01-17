import { ReactNode, useRef } from "react";
import { Button, Flex, Icon } from "@chakra-ui/react";
import { FiFile } from "react-icons/fi";
import { FilePublic, FilesService, UploadFileData, BodyFilesUploadFile } from "../../client";
import useCustomToast from "../../hooks/useCustomToast"

type FileUploadProps = {
  accept?: string;
  multiple?: boolean;
  children?: ReactNode;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const FileUpload = (props: FileUploadProps) => {
  const { accept, multiple, children, onChange } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => inputRef.current?.click();

  return (
    <div onClick={handleClick}>
      <input
        type="file"
        multiple={multiple || false}
        hidden
        accept={accept}
        ref={inputRef}
        onChange={onChange} // Trigger onChange when files are selected
      />
      <>{children}</>
    </div>
  );
};

type AppProps = {
  onUpload: (file: FilePublic) => void;
};

const App = (props: AppProps) => {
  const showToast = useCustomToast();

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    
    const formData: BodyFilesUploadFile = {
      file: files[0]  // Use only the first file if multiple are selected, or iterate if needed
    };

    try {
        const {data: response} = await FilesService.uploadFile({body: formData});
        if (!response) {
            throw new Error("File upload failed: No response from server");
        }
        showToast(
            "Success!",
            `File (${response.name}) uploaded successfully!`,
            "success",
        )
      props.onUpload(response);
    } catch (error) {
        showToast(
            "Error!",
            "There was an error uploading your file. Please try again.",
            "error",
        )
      console.error("File upload failed:", error);
    }
  };

  return (
    <Flex>
      <FileUpload
        onChange={handleFileUpload} // Trigger upload directly when files are selected
      >
        <Button
          gap={1}
          fontSize={{ base: "sm", md: "inherit" }}
          leftIcon={<Icon as={FiFile} />}>Upload</Button>
      </FileUpload>
    </Flex>
  );
};

export default App;
