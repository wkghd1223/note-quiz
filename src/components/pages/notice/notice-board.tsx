import { format } from 'date-fns';

const NoticeBoard = ({ item }: { item: NoticeType }) => {
  return (
    <section className="bg-white p-6 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">{item.title}</h1>
      <div className="flex items-center justify-between text-gray-500 text-sm mb-6">
        <span className="font-semibold">{item.authorName}</span>
        <span>{format(item.createdAt, 'yyyy-MM-dd')}</span>
      </div>
      <article className="text-gray-700 leading-relaxed">
        {item.content}
      </article>
    </section>
  );
};

export default NoticeBoard;
