import type { GetStaticPaths } from "funstack-fs-routes";

export const getStaticPaths: GetStaticPaths = () => [
  { slug: "hello-world" },
  { slug: "second-post" },
];

export default function BlogPost({ params }: { params: { slug: string } }) {
  return (
    <div>
      <h1>Blog: {params.slug}</h1>
      <a href="/blog/">Back to Blog</a>
    </div>
  );
}
