import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

let cachedAnimationData: unknown = null;
let fetchPromise: Promise<unknown> | null = null;

function loadAnimationData(): Promise<unknown> {
  if (cachedAnimationData) return Promise.resolve(cachedAnimationData);
  if (!fetchPromise) {
    fetchPromise = fetch('/searching.json')
      .then((res) => res.json())
      .then((data) => {
        cachedAnimationData = data;
        return data;
      })
      .catch(() => null);
  }
  return fetchPromise;
}

interface SearchingLoaderProps {
  size?: number;
}

export default function SearchingLoader({ size = 80 }: SearchingLoaderProps) {
  const [animationData, setAnimationData] = useState<unknown>(cachedAnimationData);

  useEffect(() => {
    if (!animationData) {
      loadAnimationData().then((data) => {
        if (data) setAnimationData(data);
      });
    }
  }, [animationData]);

  return (
    <div style={{ width: size, height: size }} className="mx-auto">
      {animationData ? (
        <Lottie animationData={animationData} loop autoplay />
      ) : (
        <div className="w-full h-full" />
      )}
    </div>
  );
}
