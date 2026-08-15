import Lottie from 'lottie-react';
import { useEffect, useState } from 'react';

let cachedAnimationData: unknown = null;
let fetchPromise: Promise<unknown> | null = null;

function loadAnimationData(): Promise<unknown> {
  if (cachedAnimationData) return Promise.resolve(cachedAnimationData);
  if (!fetchPromise) {
    fetchPromise = fetch('/dna.json')
      .then((res) => res.json())
      .then((data) => {
        cachedAnimationData = data;
        return data;
      })
      .catch(() => null);
  }
  return fetchPromise;
}

interface DnaLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export default function DnaLoader({ message = 'Loading...', fullScreen = true }: DnaLoaderProps) {
  const [animationData, setAnimationData] = useState<unknown>(cachedAnimationData);

  useEffect(() => {
    if (!animationData) {
      loadAnimationData().then((data) => {
        if (data) setAnimationData(data);
      });
    }
  }, [animationData]);

  const content = (
    <div className="text-center">
      <div className="w-36 h-36 mx-auto">
        {animationData ? (
          <Lottie animationData={animationData} loop autoplay />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      <p className="mt-3 text-sm font-medium text-gray-400 tracking-wide">
        {message}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
      {content}
    </div>
  );
}
