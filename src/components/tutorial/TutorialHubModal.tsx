import { X, Clock, Grid3x3 as Grid3X3, ChevronRight } from 'lucide-react';
import { useTutorial, tutorialLessons } from '../../tutorial/TutorialContext';
import { LESSON_CATEGORIES, type LessonCategory } from '../../tutorial/types';
import Portal from '../Portal';

const categoryIcons: Record<LessonCategory, React.ReactNode> = {
  freezerBox: <Grid3X3 className="w-5 h-5" />,
};

const categoryColors: Record<LessonCategory, string> = {
  freezerBox: 'bg-emerald-50 text-emerald-600 border-emerald-200',
};

export default function TutorialHubModal() {
  const { state, closeHub, startLesson } = useTutorial();

  if (!state.showHub) return null;

  const categories = Object.keys(LESSON_CATEGORIES) as LessonCategory[];
  const lessonsByCategory = categories.reduce((acc, cat) => {
    acc[cat] = tutorialLessons.filter((l) => l.category === cat);
    return acc;
  }, {} as Record<LessonCategory, typeof tutorialLessons>);

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Tutorial Lessons</h2>
              <p className="text-sm text-gray-500 mt-0.5">Learn how to use every feature step by step</p>
            </div>
            <button
              onClick={closeHub}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 p-6 space-y-6">
            {categories.map((category) => {
              const lessons = lessonsByCategory[category];
              if (lessons.length === 0) return null;
              const catInfo = LESSON_CATEGORIES[category];

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-lg border ${categoryColors[category]}`}>
                      {categoryIcons[category]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{catInfo.label}</h3>
                      <p className="text-xs text-gray-500">{catInfo.description}</p>
                    </div>
                  </div>

                  <div className="space-y-2 ml-1">
                    {lessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        onClick={() => startLesson(lesson.id)}
                        className="w-full group flex items-center gap-3 p-3 rounded-xl border border-gray-150 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm group-hover:text-blue-700 transition-colors">
                            {lesson.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {lesson.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {lesson.estimatedMinutes}m
                          </span>
                          <span className="text-xs text-gray-400">
                            {lesson.steps.length} steps
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <p className="text-xs text-gray-400 text-center">
              Each lesson uses practice data -- your real workspace is untouched.
            </p>
          </div>
        </div>
      </div>
    </Portal>
  );
}
