'use client'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@chakra-ui/react'
import { useEffect } from 'react'
import React from 'react'

const page = () => {
  useEffect(() => {
    const chakraBlue500 = getComputedStyle(document.documentElement).getPropertyValue('--chakra-colors-blue-500') || '';
    const emotionStyleTags = document.querySelectorAll('style[data-emotion]').length;
    const chakraButton = document.querySelector('button.chakra-button');
    // #region agent log
    fetch('http://127.0.0.1:7471/ingest/39c2ddfe-8c91-4319-a2ec-db88511e5558',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c79a5f'},body:JSON.stringify({sessionId:'c79a5f',runId:'initial',hypothesisId:'H2',location:'src/app/page.js:10',message:'Chakra runtime CSS probe',data:{chakraBlue500:chakraBlue500.trim(),emotionStyleTags},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7471/ingest/39c2ddfe-8c91-4319-a2ec-db88511e5558',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c79a5f'},body:JSON.stringify({sessionId:'c79a5f',runId:'initial',hypothesisId:'H3',location:'src/app/page.js:13',message:'Chakra button presence probe',data:{hasChakraButton:!!chakraButton,buttonClass:chakraButton?.className || null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, []);

  return (
    <div className='flex flex-col items-center justify-center h-screen'>
      <h1 className='text-4xl font-bold'>Home</h1>
      <p className='text-2xl text-gray-500'>Welcome to the home page</p>
      <Button colorScheme='blue' className='mt-4'>Get Started</Button>
    </div>
  )
}

export default AppLayout()(page);