import { redirect } from 'next/navigation';

// /account/manage has no page of its own. Credits and usage is the landing tab.
export default function ManageAccountPage() {
  redirect('/account/manage/credits');
}
