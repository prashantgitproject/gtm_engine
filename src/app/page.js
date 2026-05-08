'use client'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@chakra-ui/react'
import React from 'react'

const page = () => {

  return (
    <div className='flex flex-col items-center justify-center h-screen'>
      <h1 className='text-4xl font-bold'>Home</h1>
      <p className='text-2xl text-gray-500'>Welcome to the home page</p>
      <Button colorScheme='blue' className='mt-4'>Get Started</Button>
    </div>
  )
}

export default AppLayout()(page);