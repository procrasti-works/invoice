import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
              <div className="mt-2 h-3 w-28 animate-pulse rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="h-5 w-36 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
