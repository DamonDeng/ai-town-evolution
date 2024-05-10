import React, { useState, useEffect } from 'react';

import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";



import Button from './buttons/Button';

const TestButton = () => {

  const performMyAction = useAction(api.testing.testingFunction);
  const handleClick = () => {
    performMyAction();
  };


  // const [result, setResult] = useState(null);
  // const [input, setInput] = useState('');

  // const handleClick = async () => {
  //   try {
  //     const response = await fetch('/api/testEmbedding', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify("testing"),
  //     });
  //     console.log(response);

  //   } catch (error) {
  //     console.error('Error fetching data:', error);
  //   }
  // };



  // return (
  //   <div>

  //     <button onClick={handleClick}>Test Button</button>

  //   </div>
  // );


  return (
    <>
      <Button
        onClick={handleClick}
        className="hidden lg:block"
        title="When freezing a world, the agents will take some time to stop what they are doing before they become frozen. "
        imgUrl="/assets/star.svg"
      >
        Testing
      </Button>
    </>
  );
};

export default TestButton;
