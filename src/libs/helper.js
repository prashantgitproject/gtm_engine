export const getBase64 = async (file) => {

    const fileBuffer = await file.arrayBuffer();

    console.log("File buffer:", fileBuffer);
  
    var mime = file.type; 
    var encoding = 'base64'; 
    var base64Data = Buffer.from(fileBuffer).toString('base64');
    var fileUri = 'data:' + mime + ';' + encoding + ',' + base64Data;

    return fileUri;


}
    // `data:${file.type};base64,${file.buffer.toString("base64")}`;