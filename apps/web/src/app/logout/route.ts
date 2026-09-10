import { logoutAction } from '../(auth)/login/actions';

export async function POST() {
  await logoutAction();
}
