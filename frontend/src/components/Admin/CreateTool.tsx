import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { ToolCreate } from "@/client";
import {
  createToolMutation,
  getSystemStatsQueryKey,
  readToolsQueryKey,
} from "@/client/@tanstack/react-query.gen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import useCustomToast from "@/hooks/useCustomToast";
import { handleError } from "@/utils";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  command: z.string().trim().min(1, "Command is required"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

type CreateToolProps = {
  variant?: "dialog" | "panel";
};

const defaultJsonConfig =
  '{\n  "name": "",\n  "command": "",\n  "description": ""\n}';

const CreateTool = ({ variant = "dialog" }: CreateToolProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [jsonConfig, setJsonConfig] = useState(defaultJsonConfig);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useCustomToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      command: "",
      description: "",
    },
  });

  const mutation = useMutation({
    ...createToolMutation(),
    onSuccess: (tool) => {
      queryClient.invalidateQueries({ queryKey: readToolsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getSystemStatsQueryKey() });
      showSuccessToast("Tool created successfully");
      form.reset();
      setJsonConfig(defaultJsonConfig);
      setIsOpen(false);
      navigate({
        to: "/tools/$name/edit",
        params: { name: tool.name },
        resetScroll: true,
      });
    },
    onError: (error) => handleError(error, showErrorToast),
  });

  const onSubmit = (data: FormData) => {
    const body: ToolCreate = {
      name: data.name.trim(),
      command: data.command.trim(),
      description: data.description?.trim() || null,
    };
    mutation.mutate({ body });
  };

  const onSubmitJson = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonConfig);
    } catch {
      showErrorToast("Invalid JSON format");
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      showErrorToast("JSON must be an object");
      return;
    }

    const data = parsed as Partial<ToolCreate>;
    if (typeof data.name !== "string" || !data.name.trim()) {
      showErrorToast("JSON must include a non-empty 'name'");
      return;
    }
    if (typeof data.command !== "string" || !data.command.trim()) {
      showErrorToast("JSON must include a non-empty 'command'");
      return;
    }

    const body: ToolCreate = {
      ...data,
      name: data.name.trim(),
      command: data.command.trim(),
      description:
        typeof data.description === "string"
          ? data.description.trim() || null
          : (data.description ?? null),
    };

    mutation.mutate({ body });
  };

  const formActions =
    variant === "dialog" ? (
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" disabled={mutation.isPending}>
            Cancel
          </Button>
        </DialogClose>
        <LoadingButton type="submit" loading={mutation.isPending}>
          Create
        </LoadingButton>
      </DialogFooter>
    ) : (
      <LoadingButton type="submit" loading={mutation.isPending}>
        <Plus />
        Create Tool
      </LoadingButton>
    );

  const formContent = (
    <Tabs defaultValue="form" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="form">Form</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
      </TabsList>

      <TabsContent value="form">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Name <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Tool name" {...field} required />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="command"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Command <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-24 font-mono"
                        placeholder="python script.py --input {input}"
                        {...field}
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-20"
                        placeholder="Optional short description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {formActions}
          </form>
        </Form>
      </TabsContent>

      <TabsContent value="json">
        <form onSubmit={onSubmitJson}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="tool-json" className="text-sm font-medium">
                Tool JSON
              </label>
              <Textarea
                id="tool-json"
                className="min-h-64 font-mono"
                placeholder='{"name":"my-tool","command":"python run.py"}'
                value={jsonConfig}
                onChange={(event) => setJsonConfig(event.target.value)}
                required
              />
            </div>
          </div>

          {formActions}
        </form>
      </TabsContent>
    </Tabs>
  );

  if (variant === "panel") {
    return formContent;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Create Tool
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Tool</DialogTitle>
          <DialogDescription>
            Create the tool shell, then finish configuration in the full editor.
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default CreateTool;
