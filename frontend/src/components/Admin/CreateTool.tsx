import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { ToolCreate } from "@/client"
import {
  createToolMutation,
  getSystemStatsQueryKey,
  readToolsQueryKey,
} from "@/client/@tanstack/react-query.gen"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  command: z.string().trim().min(1, "Command is required"),
  description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

const CreateTool = () => {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
      command: "",
      description: "",
    },
  })

  const mutation = useMutation({
    ...createToolMutation(),
    onSuccess: (tool) => {
      queryClient.invalidateQueries({ queryKey: readToolsQueryKey() })
      queryClient.invalidateQueries({ queryKey: getSystemStatsQueryKey() })
      showSuccessToast("Tool created successfully")
      form.reset()
      setIsOpen(false)
      navigate({
        to: "/tools/$name/edit",
        params: { name: tool.name },
        resetScroll: true,
      })
    },
    onError: (error) => handleError(error, showErrorToast),
  })

  const onSubmit = (data: FormData) => {
    const body: ToolCreate = {
      name: data.name.trim(),
      command: data.command.trim(),
      description: data.description?.trim() || null,
    }
    mutation.mutate({ body })
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateTool
