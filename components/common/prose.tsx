/** Readable long-form text (policies, help). */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 px-5 py-6 text-[15px] leading-relaxed sm:px-8 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_h2]:pt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">
      {children}
    </div>
  )
}
