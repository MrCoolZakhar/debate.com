'use client';
import { Suspense } from 'react';
import MessagesPage from '../../../components/messages/MessagesPage';

export default function Page() { return <Suspense fallback={null}><MessagesPage /></Suspense>; }
