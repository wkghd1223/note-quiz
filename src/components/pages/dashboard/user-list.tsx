import Link from 'next/link';

interface UserListInf {
  users: any;
}

const UserList = ({ users }: UserListInf) => {
  return (
    <>
      <h2 className="font-semibold text-gray-700 mb-2">대상자 리스트</h2>
      <ul className="space-y-2">
        {users.map((user: any) => (
          <li
            key={user.id}
            className={`p-2 border rounded cursor-pointer ${
              user.status === '완료' ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <Link href={`/dashboard/${user.number}`}>
              {user.number} -{' '}
              <span className="font-semibold">{user.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};

export default UserList;
