import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Progress } from "@/components/ui/progress"
import type { UserPublic } from "../../client"
import {
  getFilesStatsOptions,
  readUserMeQueryKey,
} from "../../client/@tanstack/react-query.gen"
import { humanReadableFileSize } from "../../utils"

interface StorageStatsProps {
  size?: string
}

const StorageStats = ({ size = "sm" }: StorageStatsProps) => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(readUserMeQueryKey())
  const { data } = useQuery({
    ...getFilesStatsOptions(),
    refetchInterval: 30000,
  })

  let percentageUsed = 0
  if (data && currentUser?.max_storage) {
    percentageUsed = (data.total_size / currentUser.max_storage) * 100
    percentageUsed = Math.round(percentageUsed)
  }
  return (
    <div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          <h2
            className={
              size === "sm" ? "text-sm font-semibold" : "font-semibold"
            }
          >
            Storage
          </h2>
        </div>
        <div className="flex flex-col gap-1">
          <Progress value={percentageUsed} className="bg-gray-200" />
          <p className="text-sm text-muted-foreground">
            {data ? `${humanReadableFileSize(data.total_size)}` : "0b"} used (
            {data ? data.count : 0}/
            {currentUser ? currentUser.max_storage_files : 1000} files)
          </p>
        </div>
      </div>
    </div>
  )
}

export default StorageStats
